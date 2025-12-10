import type { API } from '@discordjs/core';
import { logger } from '#core/Logger.js';

/**
 * Event context passed to all events
 * Contains the event data and API instance
 */
export interface EventContext<T = any> {
  data: T;
  api: API;
  shardId: number;
}

/**
 * Base class for all events
 * Events now receive { data, api, shardId } context from @discordjs/core Client
 */
export abstract class BaseEvent<T = any> {
  public abstract readonly name: string;
  public abstract readonly once: boolean;

  /**
   * Execute the event
   * @param context - Contains data, api, and shardId
   */
  abstract execute(context: EventContext<T>): Promise<void>;

  /**
   * Handle event with error catching
   */
  public async handle(context: EventContext<T>): Promise<void> {
    try {
      await this.execute(context);
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
