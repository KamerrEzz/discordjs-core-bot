import { BaseEvent, type EventContext } from '../BaseEvent.js';
import { logger } from '#core/Logger.js';
import type { GatewayMessageCreateDispatchData } from '@discordjs/core';
import { moderationService } from '#modules/moderation/ModerationService.js';

export class MessageCreateEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  public readonly name = 'MESSAGE_CREATE';
  public readonly once = false;

  async execute(context: EventContext<GatewayMessageCreateDispatchData>): Promise<void> {
    const { data, api } = context;

    // Skip DMs and bot messages
    if (!data.guild_id || data.author.bot) {
      return;
    }

    // Process message through moderation
    try {
      const result = await moderationService.processMessage(data, api);
      
      if (result.shouldDelete) {
        logger.debug(
          {
            messageId: data.id,
            userId: data.author.id,
            reason: result.reason,
          },
          'Message deleted by moderation'
        );
      }
    } catch (error) {
      logger.error({ error, messageId: data.id }, 'Error processing message for moderation');
    }
  }
}
