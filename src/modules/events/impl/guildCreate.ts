import { BaseEvent, type EventContext } from '../BaseEvent.js';
import { logger } from '#core/Logger.js';
import type { GatewayGuildCreateDispatchData } from '@discordjs/core';
import { container } from '#core/Container.js';
import { GuildRepository } from '#infrastructure/database/repositories/GuildRepository.js';

export class GuildCreateEvent extends BaseEvent<GatewayGuildCreateDispatchData> {
  public readonly name = 'GUILD_CREATE';
  public readonly once = false;

  async execute(context: EventContext<GatewayGuildCreateDispatchData>): Promise<void> {
    const { data } = context;

    logger.info(
      {
        guildId: data.id,
        guildName: data.name,
        memberCount: data.member_count,
      },
      'Bot added to guild or guild became available'
    );

    // Auto-create guild record in database
    const guildRepo = await container.resolve<GuildRepository>('GuildRepository');
    
    await guildRepo.upsert(data.id, {
      id: data.id,
      prefix: '!',
      locale: data.preferred_locale || 'en',
    });

    logger.debug({ guildId: data.id }, 'Guild record upserted');
  }
}
