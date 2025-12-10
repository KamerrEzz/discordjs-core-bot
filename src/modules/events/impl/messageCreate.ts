import { BaseEvent, type EventContext } from '../BaseEvent.js';
import { logger } from '#core/Logger.js';
import type { GatewayMessageCreateDispatchData } from '@discordjs/core';

export class MessageCreateEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  public readonly name = 'MESSAGE_CREATE';
  public readonly once = false;

  async execute(context: EventContext<GatewayMessageCreateDispatchData>): Promise<void> {
    const { data } = context;

    // Skip DMs and bot messages
    if (!data.guild_id || data.author.bot) {
      return;
    }

    // Here you can add other global message logic if needed, 
    // but moderation is now handled by ModerationSystem
    
    logger.trace({ messageId: data.id }, 'Message received');
  }
}
