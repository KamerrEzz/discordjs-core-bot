import { BaseEvent } from '../BaseEvent.js';
import { logger } from '../../../core/Logger.js';
import type { GatewayReadyDispatchData } from '@discordjs/core';

export class ReadyEvent extends BaseEvent<GatewayReadyDispatchData> {
  public readonly name = 'READY';
  public readonly once = true;

  async execute(data: GatewayReadyDispatchData): Promise<void> {
    logger.info(
      {
        user: data.user.username,
        id: data.user.id,
        guilds: data.guilds.length,
      },
      '✅ Bot is ready!'
    );
  }
}
