import { BaseEvent, type EventContext } from '../BaseEvent.js';
import { logger } from '#core/Logger.js';
import type { GatewayInteractionCreateDispatchData } from '@discordjs/core';
import { InteractionType } from '@discordjs/core';
import { container } from '#core/Container.js';
import { CommandHandler } from '#modules/commands/CommandHandler.js';
import { componentHandler } from '#modules/components/ComponentHandler.js';
import { EmbedBuilder, Colors } from '#shared/utils/embed.js';

export class InteractionCreateEvent extends BaseEvent<GatewayInteractionCreateDispatchData> {
  public readonly name = 'INTERACTION_CREATE';
  public readonly once = false;

  async execute(context: EventContext<GatewayInteractionCreateDispatchData>): Promise<void> {
    const { data, api } = context;

    try {
      switch (data.type) {
        case InteractionType.ApplicationCommand:
          await this.handleApplicationCommand(data, api);
          break;
        
        case InteractionType.MessageComponent:
          await this.handleMessageComponent(data, api);
          break;
        
        case InteractionType.ModalSubmit:
          await this.handleModalSubmit(data, api);
          break;
        
        default:
          logger.debug({ type: data.type }, 'Unhandled interaction type');
      }
    } catch (error) {
      logger.error(
        {
          error,
          interactionId: data.id,
          userId: data.member?.user?.id || data.user?.id,
          type: data.type,
        },
        'Failed to handle interaction'
      );
    }
  }

  /**
   * Handle slash commands and other application commands
   */
  private async handleApplicationCommand(data: any, api: any): Promise<void> {
    const commandHandler = await container.resolve<CommandHandler>('CommandHandler');
    await commandHandler.handleInteraction(data, api);
  }

  /**
   * Handle buttons, select menus, and other message components
   */
  private async handleMessageComponent(data: any, api: any): Promise<void> {
    const { custom_id, component_type, values } = data.data;
    
    if (!custom_id) {
      logger.warn('Component interaction missing custom_id');
      return;
    }

    // Build component context
    const componentContext = {
      interaction: data,
      api,
      guildId: data.guild_id,
      userId: data.member?.user?.id || data.user?.id,
      channelId: data.channel_id,
      message: data.message,
      customId: custom_id,
      values: values,
      componentType: component_type,
    };

    // Dispatch to component handler
    await componentHandler.dispatch(custom_id, componentContext);
  }

  /**
   * Handle modal submissions
   */
  private async handleModalSubmit(data: any, api: any): Promise<void> {
    // TODO: Implement modal handling when needed
    logger.debug({ customId: data.data?.custom_id }, 'Modal submit interaction received');
  }
}
