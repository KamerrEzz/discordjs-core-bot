import { Guild, Prisma } from '../generated/prisma/client.js';
import { BaseRepository } from './BaseRepository.js';
import { prisma } from '../prisma.js';
import { cacheService } from '../../cache/CacheService.js';
import { logger } from '../../../core/Logger.js';

export class GuildRepository extends BaseRepository<
  Guild,
  Prisma.GuildCreateInput,
  Prisma.GuildUpdateInput
> {
  constructor() {
    super('guild', prisma, cacheService, {
      enableCache: true,
      cacheTTL: 1800, // 30 minutes
      cacheNamespace: 'guild',
    });
  }

  async findById(id: string): Promise<Guild | null> {
    if (this.options.enableCache) {
      return await this.cache.getOrSet(
        this.getCacheKey(id),
        async () => {
          logger.debug({ guildId: id }, 'Fetching guild from database');
          return await this.prisma.guild.findUnique({
            where: { id },
          });
        },
        {
          ttl: this.options.cacheTTL,
          namespace: this.options.cacheNamespace,
        }
      );
    }

    return await this.prisma.guild.findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<Guild[]> {
    return await this.prisma.guild.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.GuildCreateInput): Promise<Guild> {
    const guild = await this.prisma.guild.create({
      data,
    });

    logger.info({ guildId: guild.id }, 'Guild created');
    return guild;
  }

  async update(id: string, data: Prisma.GuildUpdateInput): Promise<Guild> {
    const guild = await this.prisma.guild.update({
      where: { id },
      data,
    });

    await this.invalidateCache(id);
    logger.info({ guildId: id }, 'Guild updated');
    return guild;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.guild.delete({
      where: { id },
    });

    await this.invalidateCache(id);
    logger.info({ guildId: id }, 'Guild deleted');
  }

  async upsert(
    id: string,
    data: Prisma.GuildCreateInput
  ): Promise<Guild> {
    const guild = await this.prisma.guild.upsert({
      where: { id },
      create: data,
      update: data,
    });

    await this.invalidateCache(id);
    logger.debug({ guildId: id }, 'Guild upserted');
    return guild;
  }

  async updateSettings(id: string, settings: Record<string, any>): Promise<Guild> {
    const guild = await this.update(id, {
      settings: settings as any,
    });

    return guild;
  }
}
