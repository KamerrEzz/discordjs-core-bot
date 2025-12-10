import { Redis } from 'ioredis';
import { config } from '../../core/Config.js';
import { logger } from '../../core/Logger.js';

class RedisClientService {
  private static instance: Redis;

  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisClientService.instance) {
      RedisClientService.instance = new Redis(config.get('REDIS_URL'), {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError(err) {
          logger.error({ error: err.message }, 'Redis connection error');
          return true;
        },
      });

      RedisClientService.instance.on('connect', () => {
        logger.info('Connected to Redis');
      });

      RedisClientService.instance.on('error', (err) => {
        logger.error({ error: err.message }, 'Redis error');
      });

      RedisClientService.instance.on('reconnecting', () => {
        logger.warn('Reconnecting to Redis...');
      });
    }

    return RedisClientService.instance;
  }

  public static async disconnect(): Promise<void> {
    if (RedisClientService.instance) {
      await RedisClientService.instance.quit();
      logger.info('Disconnected from Redis');
    }
  }
}

export const redis = RedisClientService.getInstance();
export { RedisClientService };
