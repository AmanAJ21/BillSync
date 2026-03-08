import { createClient } from 'redis';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  redisClient = createClient({
    url: REDIS_URL,
    socket: {
      tls: REDIS_URL.startsWith('rediss'),
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis reconnection failed');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  await redisClient.connect();
  return redisClient;
}

export async function closeRedisClient() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client closed');
  }
}

export default getRedisClient;
