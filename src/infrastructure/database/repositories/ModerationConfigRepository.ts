import { ModerationConfig, Prisma } from '../generated/prisma/client.js';
import { BaseRepository } from './BaseRepository.js';
import { prisma } from '../prisma.js';
import { cacheService } from '#infrastructure/cache/CacheService.js';
import { logger } from '#core/Logger.js';

export class ModerationConfigRepository extends BaseRepository<
  ModerationConfig,
  Prisma.ModerationConfigCreateInput,
  Prisma.ModerationConfigUpdateInput
> {
  constructor() {
    super('moderationConfig', prisma, cacheService, {
      enableCache: true,
      cacheTTL: 600, // 10 minutes - moderation config should be cached
      cacheNamespace: 'moderation',
    });
  }

  async findById(guildId: string): Promise<ModerationConfig | null> {
    if (this.options.enableCache) {
      return await this.cache.getOrSet(
        this.getCacheKey(guildId),
        async () => {
          logger.debug({ guildId }, 'Fetching moderation config from database');
          return await this.prisma.moderationConfig.findUnique({
            where: { guildId },
          });
        },
        {
          ttl: this.options.cacheTTL,
          namespace: this.options.cacheNamespace,
        }
      );
    }

    return await this.prisma.moderationConfig.findUnique({
      where: { guildId },
    });
  }

  async findAll(): Promise<ModerationConfig[]> {
    return await this.prisma.moderationConfig.findMany();
  }

  async create(data: Prisma.ModerationConfigCreateInput): Promise<ModerationConfig> {
    const config = await this.prisma.moderationConfig.create({
      data,
    });

    logger.info({ guildId: config.guildId }, 'Moderation config created');
    return config;
  }

  async update(guildId: string, data: Prisma.ModerationConfigUpdateInput): Promise<ModerationConfig> {
    const config = await this.prisma.moderationConfig.update({
      where: { guildId },
      data,
    });

    await this.invalidateCache(guildId);
    logger.info({ guildId }, 'Moderation config updated');
    return config;
  }

  async delete(guildId: string): Promise<void> {
    await this.prisma.moderationConfig.delete({
      where: { guildId },
    });

    await this.invalidateCache(guildId);
    logger.info({ guildId }, 'Moderation config deleted');
  }

  async upsert(guildId: string, data: Partial<Prisma.ModerationConfigCreateInput>): Promise<ModerationConfig> {
    const config = await this.prisma.moderationConfig.upsert({
      where: { guildId },
      create: {
        guild: { connect: { id: guildId } },
        ...data,
      },
      update: data,
    });

    await this.invalidateCache(guildId);
    logger.debug({ guildId }, 'Moderation config upserted');
    return config;
  }

  /**
   * Get config with defaults if not exists
   */
  async getOrCreate(guildId: string): Promise<ModerationConfig> {
    let config = await this.findById(guildId);
    
    if (!config) {
      config = await this.upsert(guildId, {});
    }
    
    return config;
  }
}
