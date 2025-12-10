import { redis } from './RedisClient.js';
import { logger } from '#core/Logger.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
}

/**
 * Cache Service with Redis
 * Supports namespacing, TTL, and JSON serialization
 */
export class CacheService {
  private defaultTTL: number = 3600; // 1 hour default

  /**
   * Build namespaced key
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const value = await redis.get(fullKey);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const ttl = options?.ttl ?? this.defaultTTL;
      const serialized = JSON.stringify(value);

      if (ttl > 0) {
        await redis.setex(fullKey, ttl, serialized);
      } else {
        await redis.set(fullKey, serialized);
      }

      logger.debug({ key: fullKey, ttl }, 'Cache set');
    } catch (error) {
      logger.error({ error, key }, 'Cache set error');
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      await redis.del(fullKey);
      logger.debug({ key: fullKey }, 'Cache delete');
    } catch (error) {
      logger.error({ error, key }, 'Cache delete error');
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const result = await redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Cache exists error');
      return false;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }

    logger.debug({ key }, 'Cache miss, fetching from factory');
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Delete keys matching a pattern
   */
  async deletePattern(pattern: string, options?: CacheOptions): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, options?.namespace);
      const keys = await redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      await redis.del(...keys);
      logger.debug({ pattern: fullPattern, count: keys.length }, 'Cache pattern delete');
      return keys.length;
    } catch (error) {
      logger.error({ error, pattern }, 'Cache pattern delete error');
      return 0;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const result = await redis.incr(fullKey);

      // Set TTL if provided and this is the first increment
      if (options?.ttl && result === 1) {
        await redis.expire(fullKey, options.ttl);
      }

      return result;
    } catch (error) {
      logger.error({ error, key }, 'Cache increment error');
      return 0;
    }
  }

  /**
   * Set default TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }
}

export const cacheService = new CacheService();
