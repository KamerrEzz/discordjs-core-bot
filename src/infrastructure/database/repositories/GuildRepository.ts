import { Guild, Prisma, LevelingConfig, LevelingUser } from '../generated/prisma/client.js';
import { BaseRepository } from './BaseRepository.js';
import { prisma } from '../prisma.js';
import { cacheService } from '#infrastructure/cache/CacheService.js';
import { logger } from '#core/Logger.js';

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

  // ===== LEVELING SYSTEM METHODS =====

  async findLevelingConfig(guildId: string): Promise<LevelingConfig | null> {
    return await prisma.levelingConfig.findUnique({
      where: { guildId }
    });
  }

  async upsertLevelingConfig(guildId: string, data: Partial<LevelingConfig>): Promise<LevelingConfig> {
    const { guildId: _, ...updateData } = data;
    
    return await prisma.levelingConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        enabled: updateData.enabled ?? false,
        xpPerMessage: updateData.xpPerMessage ?? 10,
        xpCooldown: updateData.xpCooldown ?? 60,
        levelUpMessage: updateData.levelUpMessage ?? null,
        roleRewards: updateData.roleRewards ?? []
      },
      update: {
        enabled: updateData.enabled,
        xpPerMessage: updateData.xpPerMessage,
        xpCooldown: updateData.xpCooldown,
        levelUpMessage: updateData.levelUpMessage,
        roleRewards: updateData.roleRewards as any
      }
    });
  }

  async findOrCreateLevelingUser(guildId: string, userId: string): Promise<LevelingUser> {
    return await prisma.levelingUser.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId
        }
      },
      create: {
        guildId,
        userId,
        xp: 0,
        level: 1
      },
      update: {}
    });
  }

  async updateLevelingUser(guildId: string, userId: string, data: Partial<LevelingUser>): Promise<LevelingUser> {
    return await prisma.levelingUser.update({
      where: {
        guildId_userId: {
          guildId,
          userId
        }
      },
      data
    });
  }

  async deleteLevelingUser(guildId: string, userId: string): Promise<void> {
    await prisma.levelingUser.delete({
      where: {
        guildId_userId: {
          guildId,
          userId
        }
      }
    });
  }

  async getTopLevelingUsers(guildId: string, limit: number = 10): Promise<LevelingUser[]> {
    return await prisma.levelingUser.findMany({
      where: { guildId },
      orderBy: { xp: 'desc' },
      take: limit
    });
  }

  async resetAllLevelingUsers(guildId: string): Promise<void> {
    await prisma.levelingUser.deleteMany({
      where: { guildId }
    });
  }
}
