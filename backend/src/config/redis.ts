/**
 * Redis client singleton (ioredis)
 * Only instantiated when REDIS_URL is set in environment.
 */
import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let redis: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redis.on('connect', () => {
    logger.info({ message: 'Redis connected' });
  });

  redis.on('error', (err: Error) => {
    logger.error({ message: 'Redis error', error: err.message });
  });
}

export { redis };
