import type { Prisma } from '../generated/prisma/client.js';
import { CacheService } from '#infrastructure/cache/CacheService.js';
import { logger } from '#core/Logger.js';

export interface RepositoryOptions {
  enableCache?: boolean;
  cacheTTL?: number;
  cacheNamespace?: string;
}

/**
 * Base Repository with CRUD operations and optional caching
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected readonly modelName: string;

  constructor(
    modelName: string,
    protected readonly prisma: any,
    protected readonly cache: CacheService,
    protected readonly options: RepositoryOptions = {}
  ) {
    this.modelName = modelName;
    this.options = {
      enableCache: false,
      cacheTTL: 3600,
      cacheNamespace: modelName,
      ...options,
    };
  }

  /**
   * Get cache key for an ID
   */
  protected getCacheKey(id: string): string {
    return `${this.modelName}:${id}`;
  }

  /**
   * Invalidate cache for a specific ID
   */
  protected async invalidateCache(id: string): Promise<void> {
    if (this.options.enableCache) {
      await this.cache.delete(this.getCacheKey(id), {
        namespace: this.options.cacheNamespace,
      });
    }
  }

  /**
   * Invalidate all cache for this model
   */
  protected async invalidateAllCache(): Promise<void> {
    if (this.options.enableCache) {
      await this.cache.deletePattern(`${this.modelName}:*`, {
        namespace: this.options.cacheNamespace,
      });
    }
  }

  /**
   * Find by ID - Must be implemented by child class
   */
  abstract findById(id: string): Promise<T | null>;

  /**
   * Find all - Must be implemented by child class
   */
  abstract findAll(): Promise<T[]>;

  /**
   * Create - Must be implemented by child class
   */
  abstract create(data: CreateInput): Promise<T>;

  /**
   * Update - Must be implemented by child class
   */
  abstract update(id: string, data: UpdateInput): Promise<T>;

  /**
   * Delete - Must be implemented by child class
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Execute in transaction
   */
  async transaction<R>(
    callback: (tx: any) => Promise<R>
  ): Promise<R> {
    logger.debug({ model: this.modelName }, 'Starting transaction');
    return await this.prisma.$transaction(callback);
  }
}
