import { BaseEvent, type EventContext } from '../BaseEvent.js';
import { logger } from '#core/Logger.js';
import type { GatewayInteractionCreateDispatchData } from '@discordjs/core';
import { InteractionType } from '@discordjs/core';
import { container } from '#core/Container.js';
import { CommandHandler } from '#modules/commands/CommandHandler.js';

export class InteractionCreateEvent extends BaseEvent<GatewayInteractionCreateDispatchData> {
  public readonly name = 'INTERACTION_CREATE';
  public readonly once = false;

  async execute(context: EventContext<GatewayInteractionCreateDispatchData>): Promise<void> {
    const { data, api } = context;

    // Only handle chat input commands for now
    if (data.type !== InteractionType.ApplicationCommand) {
      return;
    }

    const commandHandler = await container.resolve<CommandHandler>('CommandHandler');

    try {
      // Pass both the interaction data AND the API instance
      await commandHandler.handleInteraction(data as any, api);
    } catch (error) {
      logger.error(
        {
          error,
          interactionId: data.id,
          userId: data.member?.user?.id || data.user?.id,
        },
        'Failed to handle interaction'
      );
    }
  }
}
