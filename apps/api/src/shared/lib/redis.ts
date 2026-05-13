// ─────────────────────────────────────────────────────────────
// Redis Client Singleton
// Provides a Redis client instance for caching, rate limiting, and temporary state.
// ─────────────────────────────────────────────────────────────

import Redis from 'ioredis';
import { config } from '../../config/index.js';
import logger from './logger.js';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  client.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  return client;
}

export const redis: Redis =
  globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * Gracefully disconnect Redis. Call during application shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') {
    await redis.quit();
    logger.info('Redis client disconnected gracefully');
  }
}

export default redis;
