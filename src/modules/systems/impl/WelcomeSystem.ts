import { BaseSystem } from '../BaseSystem.js';
import { logger } from '../../../core/Logger.js';
import { eventHandler } from '../../events/EventHandler.js';
import { BaseEvent, type EventContext } from '../../events/BaseEvent.js';
import { GuildCreateEvent } from '../../events/impl/guildCreate.js';
import type { GatewayGuildMemberAddDispatchData } from '@discordjs/core';
import { EmbedBuilder, Colors } from '../../../shared/utils/embed.js';

// Custom event for this system (normally this would be in events/impl)
class GuildMemberAddEvent extends BaseEvent<GatewayGuildMemberAddDispatchData> {
  public readonly name = 'GUILD_MEMBER_ADD';
  public readonly once = false;

  constructor(private system: WelcomeSystem) {
    super();
  }

  async execute(context: EventContext<GatewayGuildMemberAddDispatchData>): Promise<void> {
    await this.system.handleMemberJoin(context.data);
  }
}

export class WelcomeSystem extends BaseSystem {
  public readonly name = 'WelcomeSystem';

  async onInit(): Promise<void> {
    // Register event listener dynamically
    eventHandler.register(new GuildMemberAddEvent(this));
    logger.debug('WelcomeSystem initialized');
  }

  public async handleMemberJoin(member: GatewayGuildMemberAddDispatchData): Promise<void> {
    logger.info({ userId: member.user?.id, guildId: member.guild_id }, 'Member joined');
    
    // Here logic would:
    // 1. Check DB for welcome config (cache first)
    // 2. Determine channel
    // 3. Send message/embed
    
    // Simulating logic
    // const config = await guildRepo.getWelcomeConfig(member.guild_id);
    // if (!config.enabled) return;
  }
}
