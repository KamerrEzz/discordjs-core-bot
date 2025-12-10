import type { GatewayDispatchPayload } from '@discordjs/core';
import { logger } from '../../core/Logger.js';

/**
 * Base class for all events
 */
export abstract class BaseEvent<T = any> {
  public abstract readonly name: string;
  public abstract readonly once: boolean;

  /**
   * Execute the event
   */
  abstract execute(data: T): Promise<void>;

  /**
   * Handle event with error catching
   */
  public async handle(data: T): Promise<void> {
    try {
      await this.execute(data);
    } catch (error) {
      logger.error(
        { 
          error, 
          event: this.name 
        },
        'Event execution failed'
      );
    }
  }
}
